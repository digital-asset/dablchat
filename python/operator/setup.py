import os
from setuptools import setup

setup(name='dablchat-operator-bot',
      version=os.environ.get('DDIT_VERSION', 'release'),
      description='DABL Chat Operator',
      author='Digital Asset',
      license='Apache2',
      install_requires=['dazl>=7,<8', 'aiohttp'],
      packages=['bot'],
      include_package_data=True)
