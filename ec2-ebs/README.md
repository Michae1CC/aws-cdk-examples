# Attaching EBS to EC2

A small CDK app which deploys a EC2 instance with two EBS volumes.
The commands below are used to partition the volume and create file systems.

```bash
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT
lsblk -f
# Exclude tmpfs
df -x tmpfs
# Specific filesystem
df -T /dev/xvda1
blkid
df -h --total
df -x tmpfs
df -T /dev/xvda1
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT
# Get the file type of the device
file -s /dev/xvdb
# List devices with their UUID
lsblk -f
# Partition the xvdb device
sudo parted /dev/xvdb
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT
ls 
ls -alt
pwd
sudo mkfs.xfs /dev/xvdb1
ls -l /dev/disk/by-uuid
sudo mount /dev/xvdb1 /home/ec2-user/data/
sudo chown ec2-user ./data
sudo gdisk -l /dev/xvdb
sudo xfs_growfs -d /home/ec2-user/data/
```

## References

* <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/device_naming.html>
* <https://docs.aws.amazon.com/ebs/latest/userguide/ebs-using-volumes.html>
* <https://docs.aws.amazon.com/ebs/latest/userguide/recognize-expanded-volume-linux.html>
* <https://docs.aws.amazon.com/ebs/latest/userguide/recognize-expanded-volume-linux.html?icmpid=docs_ec2_console>
* <https://www.youtube.com/watch?v=dvRYgB3T6d4>
* <https://youtu.be/2DrjQBL5FMU?si=IMuBcZBatvTqCJJE>
